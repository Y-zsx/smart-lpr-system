import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api';
import { pool, testConnection, initDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8001').trim().replace(/\/$/, '');

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
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE || 240),
  standardHeaders: true,
  legacyHeaders: false
}));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic root check
app.get('/', (req: Request, res: Response) => {
  res.send('Smart LPR System Backend is running');
});

// Health check for monitoring & LB probes
app.get('/api/health', async (_req: Request, res: Response) => {
  const health = {
    service: 'backend',
    status: 'ok' as 'ok' | 'degraded',
    timestamp: Date.now(),
    checks: {
      database: false,
      aiService: false
    }
  };

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    health.checks.database = true;
  } catch (_error) {
    health.status = 'degraded';
  }

  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`, { method: 'GET' });
    health.checks.aiService = response.ok;
    if (!response.ok) {
      health.status = 'degraded';
    }
  } catch (_error) {
    health.status = 'degraded';
  }

  if (health.status === 'ok') {
    res.status(200).json(health);
    return;
  }
  res.status(503).json(health);
});

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
