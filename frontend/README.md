# Frontend Application (前端应用)

基于 React + TypeScript + Vite 构建的智能车牌识别系统前端应用。

## 功能模块

- **实时监控**：支持多摄像头实时画面，展示实时识别结果
- **数据仪表盘**：可视化展示系统运行状态和统计数据
- **记录查询**：支持多条件筛选的历史识别记录查询，支持按车牌号分组
- **黑名单管理**：可视化的黑名单车辆管理界面
- **系统设置**：可配置识别阈值、扫描间隔等参数

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

前端应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

## 目录结构

```
frontend/
├── src/
│   ├── api/           # API 接口封装
│   ├── components/    # 通用组件
│   ├── layouts/       # 页面布局
│   ├── pages/         # 路由页面
│   ├── store/         # 全局状态管理 (Zustand)
│   ├── types/         # TypeScript 类型定义
│   └── utils/         # 工具函数
├── package.json
└── vite.config.ts
```

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **TailwindCSS** - 样式框架
- **Zustand** - 状态管理
- **Recharts** - 图表库
- **Lucide React** - 图标库

## 相关文档

- [快速开始指南](../docs/QUICK_START.md) - 快速演示和摄像头接入
- [摄像头配置指南](../docs/CAMERA_SETUP.md) - 详细的摄像头配置说明
