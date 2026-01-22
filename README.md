# Smart LPR System (智能车牌识别系统)

这是一个基于 React 和 Node.js 的全栈智能车牌识别系统，集成了 HyperLPR3 进行 AI 车牌识别。

## 项目结构

- `frontend/`: 前端应用 (React + TypeScript + Vite + TailwindCSS)
- `backend/`: 后端服务 (Node.js + Express + TypeScript)
- `ai-service/`: AI 识别服务 (Python + FastAPI + HyperLPR3)

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

## 功能特性

- 🚗 **实时车牌识别**：集成 HyperLPR3 高精度识别算法。
- 📊 **数据仪表盘**：实时展示今日流量、车型分布及趋势分析。
- 📈 **统计报表**：提供每日流量趋势图和区域流量统计。
- 📝 **记录管理**：完整的识别记录查询、筛选和导出功能。
- 🚫 **黑名单管理**：支持黑名单车辆管理及自动告警。
- 📱 **响应式设计**：完美适配桌面端和移动端设备。

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
