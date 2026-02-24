import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './routes/api';
import { testConnection, initDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Request logging middleware - Place this FIRST
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/', (req: Request, res: Response) => {
  res.send('Smart LPR System Backend is running');
});

// Request logging middleware
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   next();
// });

// Request logging middleware
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   next();
// });

// API Routes
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化数据库（创建数据库和表）
    await initDatabase();
    
    // 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
      console.error('⚠️  数据库连接失败，但服务器将继续启动');
      console.error('⚠️  请检查数据库配置和 MySQL 服务是否运行');
    }

    app.listen(port, () => {
      console.log(`🚀 服务器运行在 http://localhost:${port}`);
      console.log('✅ API 路由已加载');
    });
  } catch (error) {
    console.error('❌ 启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
