# Smart LPR System - Frontend

基于 React + TypeScript + Vite 构建的智能车牌识别系统前端应用。

## 功能模块

- **实时监控**：模拟摄像头实时画面，展示实时识别结果。
- **数据仪表盘**：可视化展示系统运行状态和统计数据。
- **记录查询**：支持多条件筛选的历史识别记录查询。
- **黑名单管理**：可视化的黑名单车辆管理界面。
- **系统设置**：可配置识别阈值、扫描间隔等参数。

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
```

## 目录结构

- `src/api/`: API 接口封装
- `src/components/`: 通用组件
- `src/layouts/`: 页面布局
- `src/pages/`: 路由页面
- `src/store/`: 全局状态管理 (Zustand)
- `src/types/`: TypeScript 类型定义
- `src/utils/`: 工具函数
