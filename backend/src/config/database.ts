import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_lpr',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 创建连接池
export const pool = mysql.createPool(dbConfig);

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
};

// 初始化数据库（创建数据库和表）
export const initDatabase = async (): Promise<void> => {
  try {
    // 先连接到 MySQL 服务器（不指定数据库）
    const adminConfig = {
      ...dbConfig,
      database: undefined
    };
    const adminPool = mysql.createPool(adminConfig);

    // 创建数据库（如果不存在）
    await adminPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await adminPool.end();

    // 使用目标数据库创建表
    const connection = await pool.getConnection();

    // 创建 plates 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`plates\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`number\` VARCHAR(20) NOT NULL,
        \`type\` ENUM('blue', 'yellow', 'green', 'white', 'black') NOT NULL,
        \`confidence\` DECIMAL(5,4) NOT NULL,
        \`timestamp\` BIGINT NOT NULL,
        \`image_url\` VARCHAR(500),
        \`location\` VARCHAR(100),
        \`rect_x\` INT,
        \`rect_y\` INT,
        \`rect_w\` INT,
        \`rect_h\` INT,
        \`saved\` TINYINT(1) DEFAULT 0,
        INDEX \`idx_timestamp\` (\`timestamp\`),
        INDEX \`idx_number\` (\`number\`),
        INDEX \`idx_type\` (\`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 blacklist 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`blacklist\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`plate_number\` VARCHAR(20) NOT NULL UNIQUE,
        \`reason\` VARCHAR(500) NOT NULL,
        \`severity\` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
        \`created_at\` BIGINT NOT NULL,
        INDEX \`idx_plate_number\` (\`plate_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 alarms 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`alarms\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`plate_id\` VARCHAR(36),
        \`blacklist_id\` INT,
        \`timestamp\` BIGINT NOT NULL,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`plate_number\` VARCHAR(20) NOT NULL,
        \`image_path\` VARCHAR(500),
        \`location\` VARCHAR(100),
        \`reason\` VARCHAR(500) NOT NULL,
        \`severity\` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
        INDEX \`idx_timestamp\` (\`timestamp\`),
        INDEX \`idx_is_read\` (\`is_read\`),
        INDEX \`idx_plate_number\` (\`plate_number\`),
        FOREIGN KEY (\`plate_id\`) REFERENCES \`plates\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`blacklist_id\`) REFERENCES \`blacklist\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建 plate_records 表（识别记录表）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`plate_records\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`plate_number\` VARCHAR(20) NOT NULL,
        \`plate_type\` ENUM('blue', 'yellow', 'green', 'white', 'black') NOT NULL,
        \`confidence\` DECIMAL(5,4) NOT NULL,
        \`timestamp\` BIGINT NOT NULL,
        \`camera_id\` VARCHAR(100),
        \`camera_name\` VARCHAR(200),
        \`location\` VARCHAR(200),
        \`image_url\` VARCHAR(500),
        \`rect_x\` INT,
        \`rect_y\` INT,
        \`rect_w\` INT,
        \`rect_h\` INT,
        \`created_at\` BIGINT NOT NULL,
        INDEX \`idx_plate_number\` (\`plate_number\`),
        INDEX \`idx_timestamp\` (\`timestamp\`),
        INDEX \`idx_camera_id\` (\`camera_id\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    connection.release();
    console.log('✅ 数据库表初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};
