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

### 2. 启动后端服务 (Node.js)

```bash
cd backend
npm install
npm run dev
```

后端服务将在 `http://localhost:8000` 启动。

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
- LowDB (本地 JSON 数据库)
- Multer (文件上传)
