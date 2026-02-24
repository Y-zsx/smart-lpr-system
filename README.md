# Smart LPR System

> 智能车牌识别系统 - 基于 AI 的全栈车牌识别解决方案

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)](https://www.python.org/)

## ✨ 功能特性

- 🚗 **高精度识别** - 基于 HyperLPR3 深度学习算法，支持多种车牌类型
- 📹 **多源输入** - 支持 USB 摄像头、网络摄像头、视频文件
- 📊 **实时监控** - 实时展示识别结果和统计数据
- 📈 **数据分析** - 流量统计、趋势分析、区域分布热力图
- 🚫 **黑名单管理** - 自动告警和车辆轨迹追踪
- 📱 **响应式设计** - 完美适配桌面端和移动端

## 🚀 快速开始

### 环境要求

- **Node.js** 18+ 
- **Python** 3.8+
- **MySQL** 8.0+
- **npm** 最新版本

### 一键启动（Windows）

```powershell
.\start-dev.ps1
```

脚本会自动启动三个服务：
- AI 识别服务：`http://localhost:8001`
- 后端服务：`http://localhost:8000`
- 前端应用：`http://localhost:5173`

### 手动启动

#### 1. 启动 AI 服务

```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

#### 2. 配置并启动后端

```bash
cd backend
# 复制环境配置
cp .env
# 编辑 .env 文件，配置数据库连接信息

npm install
npm run dev
```

**数据库配置示例**：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_lpr
```

> 💡 后端启动时会自动创建数据库和表结构

#### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173` 查看应用。

## 📁 项目结构

```
smart-lpr-system/
├── frontend/              # 前端应用 (React + TypeScript)
│   ├── src/
│   │   ├── api/          # API 接口封装
│   │   ├── features/     # 业务域脚手架（稳妥版）
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 页面路由
│   │   ├── store/        # 状态管理
│   │   └── utils/        # 工具函数
│   └── public/           # 静态资源
│
├── backend/              # 后端服务 (Node.js + Express)
│   ├── src/
│   │   ├── modules/      # 业务模块脚手架（稳妥版）
│   │   ├── controllers/  # 业务控制器
│   │   ├── routes/       # API 路由
│   │   ├── services/     # 领域服务
│   │   └── config/       # 配置文件
│   └── uploads/           # 上传文件存储
│
├── ai-service/           # AI 识别服务 (Python + FastAPI)
│   ├── app/              # 服务核心实现
│   ├── evaluation/       # 评估脚本实现
│   ├── main.py           # 兼容入口
│   ├── evaluation.py     # 兼容入口
│   └── requirements.txt  # Python 依赖
│
├── docs/                 # 项目文档
│   ├── QUICK_START.md    # 快速开始指南
│   ├── CAMERA_SETUP.md   # 摄像头配置
│   ├── DATABASE.md       # 数据库配置
│   └── IAM_RBAC.md       # 权限模型说明
│
├── scripts/              # 数据库脚本
│   ├── init_database.sql # 初始化脚本
│   └── verify_database.sql # 验证脚本
│
└── start-dev.ps1         # Windows 启动脚本
```

> 说明：当前为“稳妥版结构优化”，以兼容现有运行逻辑为优先。旧目录继续可用，新代码建议优先进入 `backend/src/modules` 与 `frontend/src/features`。

## 🛠️ 技术栈

| 模块 | 技术 |
|------|------|
| **前端** | React 18, TypeScript, Vite, TailwindCSS, Zustand |
| **后端** | Node.js, Express, TypeScript, MySQL |
| **AI服务** | Python, FastAPI, HyperLPR3, OpenCV |

## 📚 文档

- 🚀 [云服务器部署指南](docs/DEPLOYMENT.md) - **保姆级部署教程** ⭐
- 📖 [快速开始指南](docs/QUICK_START.md) - 3分钟快速上手
- 📹 [摄像头配置指南](docs/CAMERA_SETUP.md) - 摄像头接入方案
- 🗄️ [数据库配置指南](docs/DATABASE.md) - MySQL 配置说明
- 📊 [数据记录说明](docs/PLATE_RECORDS.md) - 数据结构说明
- 🗺️ [高德地图配置](docs/AMAP_SETUP.md) - 地理位置功能

## 🔧 开发

### 端口说明

- **前端**: `http://localhost:5173`
- **后端**: `http://localhost:8000`
- **AI服务**: `http://localhost:8001`

### 数据库脚本

```bash
# 初始化数据库
mysql -u root -p < scripts/init_database.sql

# 验证数据库
mysql -u root -p < scripts/verify_database.sql
```

更多脚本说明请查看 [scripts/README.md](scripts/README.md)

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**需要帮助？** 查看 [文档索引](docs/README.md) 获取更多信息。
