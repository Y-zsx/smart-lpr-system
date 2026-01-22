# Smart LPR System (智能车牌识别系统)

这是一个基于 React 和 Node.js 的全栈智能车牌识别系统，集成了 HyperLPR3 进行 AI 车牌识别。

## 📁 项目结构

```
smart-lpr-system/
├── frontend/          # 前端应用 (React + TypeScript + Vite + TailwindCSS)
│   ├── src/
│   │   ├── api/       # API 接口封装
│   │   ├── components/# 通用组件
│   │   ├── layouts/   # 页面布局
│   │   ├── pages/     # 路由页面
│   │   ├── store/     # 状态管理 (Zustand)
│   │   ├── types/     # TypeScript 类型定义
│   │   └── utils/     # 工具函数
│   └── package.json
├── backend/           # 后端服务 (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/    # 配置文件
│   │   ├── controllers/# 控制器
│   │   ├── routes/    # 路由定义
│   │   └── utils/     # 工具函数
│   └── package.json
├── ai-service/        # AI 识别服务 (Python + FastAPI + HyperLPR3)
│   ├── main.py
│   └── requirements.txt
├── docs/              # 项目文档
│   ├── README.md           # 文档索引
│   ├── QUICK_START.md      # 快速开始指南
│   ├── CAMERA_SETUP.md     # 摄像头配置指南
│   ├── PLATE_RECORDS.md    # 数据记录说明
│   └── DATABASE.md         # 数据库配置指南
├── scripts/           # 数据库脚本
│   ├── README.md           # 脚本说明
│   ├── init_database.sql           # 数据库初始化脚本
│   ├── migrate_to_plate_records.sql # 数据迁移脚本
│   └── verify_database.sql         # 数据库验证脚本
├── start-dev.ps1      # Windows 一键启动脚本
└── README.md          # 项目说明文档
```

## 快速开始 (Windows 一键启动)

如果你在 Windows 环境下，可以直接运行根目录下的启动脚本：

```powershell
.\start-dev.ps1
```

这将自动打开三个 PowerShell 窗口，分别启动 AI 服务、后端服务和前端应用。

## 手动启动指南

如果你更喜欢手动控制，或者在非 Windows 环境下，请按照以下步骤操作：

### 1. 启动 AI 识别服务 (Python)

确保已安装 Python 3.8+。

```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

AI 服务将在 `http://localhost:8001` 启动。

### 2. 配置数据库 (MySQL)

后端使用 MySQL 数据库存储数据。请按照以下步骤配置：

1. **安装 MySQL**
   - 如果还没有安装 MySQL，请先安装 MySQL 8.0 或更高版本
   - 下载地址：https://dev.mysql.com/downloads/mysql/

2. **创建数据库配置**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   然后编辑 `.env` 文件，配置数据库连接信息：
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password_here
   DB_NAME=smart_lpr
   ```

3. **启动 MySQL 服务**
   - Windows: 确保 MySQL 服务正在运行
   - Linux/Mac: `sudo systemctl start mysql` 或 `brew services start mysql`

4. **安装依赖并启动后端**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

   后端服务启动时会自动创建数据库和表结构。服务将在 `http://localhost:8000` 启动。

### 3. 启动前端应用

```bash
cd frontend
npm install
npm run dev
```

前端应用将在 `http://localhost:5173` 启动。

## ✨ 功能特性

- 🚗 **实时车牌识别**：集成 HyperLPR3 高精度识别算法，支持多种车牌类型识别
- 📹 **多摄像头支持**：支持本地USB摄像头、网络摄像头（MJPEG/HLS）和视频文件输入
- 📊 **数据仪表盘**：实时展示今日流量、车型分布及趋势分析
- 📈 **统计报表**：提供每日流量趋势图和区域流量统计
- 📝 **记录管理**：完整的识别记录查询、筛选和导出功能，支持按车牌号分组查询
- 🚫 **黑名单管理**：支持黑名单车辆管理及自动告警
- 📱 **响应式设计**：完美适配桌面端和移动端设备
- ⚙️ **灵活配置**：可调整扫描间隔、置信度阈值等参数

## 技术栈

### AI 服务
- Python
- FastAPI
- HyperLPR3 (基于深度学习的高性能车牌识别)
- OpenCV

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
- MySQL (关系型数据库)
- Multer (文件上传)

## 📚 文档说明

项目详细文档位于 `docs/` 目录，请查看 [文档索引](docs/README.md) 获取完整文档列表：

- **[文档索引](docs/README.md)** - 所有文档的索引和推荐阅读顺序
- **[快速开始指南](docs/QUICK_START.md)** - 3分钟快速演示，包含视频文件演示、真实摄像头接入等
- **[摄像头配置指南](docs/CAMERA_SETUP.md)** - 详细的摄像头接入方案，包括USB摄像头、网络摄像头、视频文件等
- **[数据记录说明](docs/PLATE_RECORDS.md)** - 车牌识别记录的数据结构和使用方法
- **[数据库配置指南](docs/DATABASE.md)** - MySQL数据库配置和表结构说明

## 🛠️ 数据库脚本

数据库相关脚本位于 `scripts/` 目录，请查看 [脚本说明](scripts/README.md) 了解详细使用方法：

- **[脚本说明](scripts/README.md)** - 脚本使用说明和执行方法
- `init_database.sql` - 初始化数据库和表结构
- `migrate_to_plate_records.sql` - 迁移到新的记录结构
- `verify_database.sql` - 验证数据库配置

## 📝 开发说明

### 环境要求

- **Node.js**: 18+ 
- **Python**: 3.8+
- **MySQL**: 8.0+
- **npm/yarn**: 最新版本

### 端口说明

- **前端**: http://localhost:5173
- **后端**: http://localhost:8000
- **AI服务**: http://localhost:8001
