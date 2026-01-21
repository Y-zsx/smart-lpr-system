# Smart LPR System (智能车牌识别系统)

这是一个基于 React 和 Node.js 的全栈智能车牌识别系统。

## 项目结构

- `frontend/`: 前端应用 (React + TypeScript + Vite + TailwindCSS)
- `backend/`: 后端服务 (Node.js + Express + TypeScript)

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端服务将在 `http://localhost:8000` 启动。

### 2. 启动前端应用

```bash
cd frontend
npm install
npm run dev
```

前端应用将在 `http://localhost:5173` 启动。

## 功能特性

- 🚗 **实时车牌识别**：支持图片上传和实时流识别（模拟）。
- 📊 **数据仪表盘**：实时展示今日流量、车型分布及趋势分析。
- 📈 **统计报表**：提供每日流量趋势图和区域流量统计。
- 📝 **记录管理**：完整的识别记录查询、筛选和导出功能。
- 🚫 **黑名单管理**：支持黑名单车辆管理及自动告警。
- 📱 **响应式设计**：完美适配桌面端和移动端设备。

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand (状态管理)
- Recharts (图表库)
- Lucide React (图标库)

### 后端
- Node.js
- Express
- TypeScript
- LowDB (本地 JSON 数据库)
- Multer (文件上传)
