import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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
        \`record_id\` VARCHAR(36),
        \`blacklist_id\` INT,
        \`timestamp\` BIGINT NOT NULL,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`is_deleted\` TINYINT(1) DEFAULT 0,
        \`plate_number\` VARCHAR(20) NOT NULL,
        \`camera_id\` VARCHAR(255),
        \`region_code\` VARCHAR(100),
        \`image_path\` VARCHAR(500),
        \`location\` VARCHAR(100),
        \`reason\` VARCHAR(500) NOT NULL,
        \`severity\` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
        INDEX \`idx_timestamp\` (\`timestamp\`),
        INDEX \`idx_is_read\` (\`is_read\`),
        INDEX \`idx_is_deleted\` (\`is_deleted\`),
        INDEX \`idx_plate_number\` (\`plate_number\`),
        INDEX \`idx_camera_id\` (\`camera_id\`),
        INDEX \`idx_region_code\` (\`region_code\`),
        FOREIGN KEY (\`plate_id\`) REFERENCES \`plates\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`blacklist_id\`) REFERENCES \`blacklist\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 尝试为已存在的 alarms 表添加字段
    try {
      await connection.execute(`ALTER TABLE \`alarms\` ADD COLUMN \`is_deleted\` TINYINT(1) DEFAULT 0 AFTER \`is_read\``);
      await connection.execute(`CREATE INDEX \`idx_is_deleted\` ON \`alarms\` (\`is_deleted\`)`);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        // console.log('is_deleted 字段已存在或添加失败:', e.message);
      }
    }

    try {
      await connection.execute(`ALTER TABLE \`alarms\` ADD COLUMN \`record_id\` VARCHAR(36) AFTER \`plate_id\``);
      await connection.execute(`ALTER TABLE \`alarms\` ADD CONSTRAINT \`fk_alarms_record_id\` FOREIGN KEY (\`record_id\`) REFERENCES \`plate_records\`(\`id\`) ON DELETE SET NULL`);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        // console.log('record_id 字段已存在或添加失败:', e.message);
      }
    }
    try {
      await connection.execute(`ALTER TABLE \`alarms\` ADD COLUMN \`camera_id\` VARCHAR(255) AFTER \`plate_number\``);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        // ignore for backward compatibility
      }
    }
    try {
      await connection.execute(`ALTER TABLE \`alarms\` ADD COLUMN \`region_code\` VARCHAR(100) AFTER \`camera_id\``);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        // ignore for backward compatibility
      }
    }

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
        \`region_code\` VARCHAR(100),
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
        INDEX \`idx_region_code\` (\`region_code\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      await connection.execute(`ALTER TABLE \`plate_records\` ADD COLUMN \`region_code\` VARCHAR(100) AFTER \`camera_name\``);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        // ignore
      }
    }

    // IAM users/roles/permissions
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_users\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`display_name\` VARCHAR(100) NOT NULL,
        \`status\` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
        \`created_at\` BIGINT NOT NULL,
        \`updated_at\` BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_roles\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`role_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`role_name\` VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255),
        \`created_at\` BIGINT NOT NULL,
        \`updated_at\` BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_permissions\` (
        \`id\` VARCHAR(100) PRIMARY KEY,
        \`permission_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`permission_name\` VARCHAR(200) NOT NULL,
        \`group_key\` VARCHAR(100) NOT NULL,
        \`created_at\` BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_role_permissions\` (
        \`role_id\` VARCHAR(64) NOT NULL,
        \`permission_id\` VARCHAR(100) NOT NULL,
        PRIMARY KEY (\`role_id\`, \`permission_id\`),
        FOREIGN KEY (\`role_id\`) REFERENCES \`iam_roles\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`permission_id\`) REFERENCES \`iam_permissions\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_user_roles\` (
        \`user_id\` VARCHAR(64) NOT NULL,
        \`role_id\` VARCHAR(64) NOT NULL,
        PRIMARY KEY (\`user_id\`, \`role_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`iam_users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`role_id\`) REFERENCES \`iam_roles\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`iam_role_data_scopes\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_id\` VARCHAR(64) NOT NULL,
        \`scope_type\` ENUM('all', 'camera', 'region') NOT NULL,
        \`scope_value\` VARCHAR(255) NOT NULL,
        INDEX \`idx_role_scope\` (\`role_id\`, \`scope_type\`),
        FOREIGN KEY (\`role_id\`) REFERENCES \`iam_roles\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed roles
    const now = Date.now();
    await connection.execute(
      `INSERT INTO iam_roles (id, role_key, role_name, description, created_at, updated_at)
       VALUES
       ('role_admin', 'admin', '系统管理员', '全量管理权限', ?, ?),
       ('role_operator', 'operator', '值班员', '业务操作权限', ?, ?),
       ('role_viewer', 'viewer', '只读用户', '仅查看数据', ?, ?)
       ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), description = VALUES(description), updated_at = VALUES(updated_at)`,
      [now, now, now, now, now, now]
    );

    // Seed permissions
    const permissionSeeds: Array<[string, string, string, string]> = [
      ['perm_dashboard_view', 'dashboard.view', '查看仪表盘', 'dashboard'],
      ['perm_monitor_view', 'monitor.view', '查看实时监控', 'monitor'],
      ['perm_records_view', 'records.view', '查看识别记录', 'records'],
      ['perm_alarms_view', 'alarms.view', '查看告警', 'alarms'],
      ['perm_plate_manage', 'plate.manage', '管理识别记录', 'records'],
      ['perm_alarm_manage', 'alarm.manage', '处理告警', 'alarms'],
      ['perm_blacklist_manage', 'blacklist.manage', '管理黑名单', 'alarms'],
      ['perm_camera_manage', 'camera.manage', '管理摄像头', 'monitor'],
      ['perm_iam_manage', 'iam.manage', '管理权限配置', 'iam']
    ];

    for (const [id, permissionKey, permissionName, groupKey] of permissionSeeds) {
      await connection.execute(
        `INSERT INTO iam_permissions (id, permission_key, permission_name, group_key, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name), group_key = VALUES(group_key)`,
        [id, permissionKey, permissionName, groupKey, now]
      );
    }

    // Seed users
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const operatorUsername = process.env.OPERATOR_USERNAME || 'operator';
    const operatorPassword = process.env.OPERATOR_PASSWORD || 'operator123';
    const viewerUsername = process.env.VIEWER_USERNAME || 'viewer';
    const viewerPassword = process.env.VIEWER_PASSWORD || 'viewer123';
    const passwordSaltRounds = Math.max(8, Number(process.env.PASSWORD_SALT_ROUNDS || 10));
    const [adminPasswordHash, operatorPasswordHash, viewerPasswordHash] = await Promise.all([
      bcrypt.hash(adminPassword, passwordSaltRounds),
      bcrypt.hash(operatorPassword, passwordSaltRounds),
      bcrypt.hash(viewerPassword, passwordSaltRounds)
    ]);

    await connection.execute(
      `INSERT INTO iam_users (id, username, password, display_name, status, created_at, updated_at)
       VALUES
       ('user_admin', ?, ?, '系统管理员', 'active', ?, ?),
       ('user_operator', ?, ?, '值班员', 'active', ?, ?),
       ('user_viewer', ?, ?, '访客', 'active', ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password), display_name = VALUES(display_name), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [adminUsername, adminPasswordHash, now, now, operatorUsername, operatorPasswordHash, now, now, viewerUsername, viewerPasswordHash, now, now]
    );

    // Seed role-permissions
    const rolePermissions: Array<[string, string]> = [
      ['role_admin', 'perm_dashboard_view'],
      ['role_admin', 'perm_monitor_view'],
      ['role_admin', 'perm_records_view'],
      ['role_admin', 'perm_alarms_view'],
      ['role_admin', 'perm_plate_manage'],
      ['role_admin', 'perm_alarm_manage'],
      ['role_admin', 'perm_blacklist_manage'],
      ['role_admin', 'perm_camera_manage'],
      ['role_admin', 'perm_iam_manage'],
      ['role_operator', 'perm_dashboard_view'],
      ['role_operator', 'perm_monitor_view'],
      ['role_operator', 'perm_records_view'],
      ['role_operator', 'perm_alarms_view'],
      ['role_operator', 'perm_plate_manage'],
      ['role_operator', 'perm_alarm_manage'],
      ['role_operator', 'perm_blacklist_manage'],
      ['role_operator', 'perm_camera_manage'],
      ['role_viewer', 'perm_dashboard_view'],
      ['role_viewer', 'perm_monitor_view'],
      ['role_viewer', 'perm_records_view'],
      ['role_viewer', 'perm_alarms_view']
    ];

    for (const [roleId, permissionId] of rolePermissions) {
      await connection.execute(
        `INSERT IGNORE INTO iam_role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleId, permissionId]
      );
    }

    // Seed user-roles
    await connection.execute(`INSERT IGNORE INTO iam_user_roles (user_id, role_id) VALUES ('user_admin', 'role_admin')`);
    await connection.execute(`INSERT IGNORE INTO iam_user_roles (user_id, role_id) VALUES ('user_operator', 'role_operator')`);
    await connection.execute(`INSERT IGNORE INTO iam_user_roles (user_id, role_id) VALUES ('user_viewer', 'role_viewer')`);

    // Seed default data scopes: admin/operator all
    await connection.execute(
      `INSERT IGNORE INTO iam_role_data_scopes (role_id, scope_type, scope_value)
       VALUES ('role_admin', 'all', '*'), ('role_operator', 'all', '*')`
    );

    connection.release();
    console.log('✅ 数据库表初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};
