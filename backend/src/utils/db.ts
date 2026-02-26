import { pool } from '../config/database';
import { LicensePlate, BlacklistItem, Alarm, Rect, PlateRecord, PlateGroup } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { enqueueAlarmClipCapture } from '../services/alarmMediaService';

// 数据库接口
export interface Database {
  plates: LicensePlate[];
  blacklist: BlacklistItem[];
  alarms: Alarm[];
}

// ========== Plates 相关操作 ==========

export const getPlates = async (filters?: {
  start?: number;
  end?: number;
  type?: string;
}): Promise<LicensePlate[]> => {
  const records = await getAllPlateRecords({
    start: filters?.start,
    end: filters?.end,
    type: filters?.type
  });
  return records.map((record) => ({
    id: record.id,
    number: record.plateNumber,
    type: record.plateType,
    confidence: record.confidence,
    timestamp: record.timestamp,
    imageUrl: record.imageUrl,
    location: record.location,
    rect: record.rect,
    saved: true,
    cameraId: record.cameraId,
    cameraName: record.cameraName
  }));
};

export const savePlate = async (plate: LicensePlate): Promise<LicensePlate> => {
  const record: PlateRecord = {
    id: plate.id,
    plateNumber: plate.number,
    plateType: plate.type,
    confidence: plate.confidence,
    timestamp: plate.timestamp,
    cameraId: plate.cameraId,
    cameraName: plate.cameraName || plate.location,
    location: plate.location,
    imageUrl: plate.imageUrl,
    rect: plate.rect,
    createdAt: plate.timestamp || Date.now()
  };
  await savePlateRecord(record);
  return plate;
};

// ========== Blacklist 相关操作 ==========

export const getBlacklist = async (): Promise<BlacklistItem[]> => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `blacklist` ORDER BY `created_at` DESC'
    );
    
    return rows.map((row: RowDataPacket) => ({
      id: row.id,
      plate_number: row.plate_number,
      reason: row.reason,
      severity: row.severity,
      created_at: parseInt(row.created_at)
    }));
  } finally {
    connection.release();
  }
};

export const addBlacklist = async (item: Omit<BlacklistItem, 'id' | 'created_at'>): Promise<BlacklistItem> => {
  const connection = await pool.getConnection();
  try {
    const query = `
      INSERT INTO \`blacklist\` (\`plate_number\`, \`reason\`, \`severity\`, \`created_at\`)
      VALUES (?, ?, ?, ?)
    `;
    
    const created_at = Date.now();
    const [result] = await connection.execute<ResultSetHeader>(query, [
      item.plate_number,
      item.reason,
      item.severity,
      created_at
    ]);

    return {
      id: result.insertId,
      plate_number: item.plate_number,
      reason: item.reason,
      severity: item.severity,
      created_at
    };
  } finally {
    connection.release();
  }
};

export const deleteBlacklist = async (id: number): Promise<boolean> => {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM `blacklist` WHERE `id` = ?',
      [id]
    );
    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
};

// ========== Alarms 相关操作 ==========

export const getAlarms = async (): Promise<Alarm[]> => {
  const connection = await pool.getConnection();
  const alarmQueryWithRect = `
    SELECT
      a.*,
      pr.plate_type AS plate_type,
      pr.rect_x AS rect_x,
      pr.rect_y AS rect_y,
      pr.rect_w AS rect_w,
      pr.rect_h AS rect_h
    FROM \`alarms\` a
    LEFT JOIN \`plate_records\` pr ON a.record_id = pr.id
    WHERE a.\`is_deleted\` = 0
    ORDER BY a.\`is_read\` ASC, a.\`timestamp\` DESC
  `;
  const alarmFallbackQueryWithRect = `
    SELECT
      a.*,
      pr.plate_type AS plate_type,
      pr.rect_x AS rect_x,
      pr.rect_y AS rect_y,
      pr.rect_w AS rect_w,
      pr.rect_h AS rect_h
    FROM \`alarms\` a
    LEFT JOIN \`plate_records\` pr ON a.record_id = pr.id
    ORDER BY a.\`is_read\` ASC, a.\`timestamp\` DESC
  `;
  const mapAlarmRow = (row: RowDataPacket): Alarm => ({
    id: row.id,
    plate_id: row.plate_id || undefined,
    record_id: row.record_id || undefined,
    blacklist_id: row.blacklist_id || undefined,
    timestamp: parseInt(row.timestamp),
    is_read: row.is_read,
    plate_number: row.plate_number,
    camera_id: row.camera_id || undefined,
    region_code: row.region_code || undefined,
    image_path: row.image_path || undefined,
    plate_type: row.plate_type || undefined,
    rect: row.rect_x !== null && row.rect_y !== null && row.rect_w !== null && row.rect_h !== null
      ? {
          x: row.rect_x,
          y: row.rect_y,
          w: row.rect_w,
          h: row.rect_h
        }
      : undefined,
    location: row.location || undefined,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    reason: row.reason,
    severity: row.severity
  });
  try {
    // 优先返回未读告警，然后按时间倒序
    // 仅返回未软删除的告警
    const [rows] = await connection.execute<RowDataPacket[]>(
      alarmQueryWithRect
    );
    
    return rows.map(mapAlarmRow);
  } catch (error: any) {
    // 如果 is_deleted 字段不存在，回退到旧查询
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[DB] is_deleted field missing in alarms table, falling back to full query');
      const [rows] = await connection.execute<RowDataPacket[]>(
        alarmFallbackQueryWithRect
      );
      return rows.map(mapAlarmRow);
    }
    throw error;
  } finally {
    connection.release();
  }
};

export const getBlacklistItem = async (id: number): Promise<BlacklistItem | null> => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `blacklist` WHERE `id` = ?',
      [id]
    );
    
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      plate_number: row.plate_number,
      reason: row.reason,
      severity: row.severity,
      created_at: parseInt(row.created_at)
    };
  } finally {
    connection.release();
  }
};

export const deleteAlarmsByBlacklistId = async (blacklistId: number): Promise<number> => {
  const connection = await pool.getConnection();
  try {
    // 软删除：更新 is_deleted = 1
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE `alarms` SET `is_deleted` = 1 WHERE `blacklist_id` = ?',
        [blacklistId]
      );
      return result.affectedRows;
    } catch (error: any) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        // 如果字段不存在，执行物理删除
        const [result] = await connection.execute<ResultSetHeader>(
          'DELETE FROM `alarms` WHERE `blacklist_id` = ?',
          [blacklistId]
        );
        return result.affectedRows;
      }
      throw error;
    }
  } finally {
    connection.release();
  }
};

export const deleteAlarmsByPlateNumber = async (plateNumber: string): Promise<number> => {
  const connection = await pool.getConnection();
  try {
    // 软删除：更新 is_deleted = 1
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE `alarms` SET `is_deleted` = 1 WHERE `plate_number` = ?',
        [plateNumber]
      );
      return result.affectedRows;
    } catch (error: any) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        // 如果字段不存在，执行物理删除
        const [result] = await connection.execute<ResultSetHeader>(
          'DELETE FROM `alarms` WHERE `plate_number` = ?',
          [plateNumber]
        );
        return result.affectedRows;
      }
      throw error;
    }
  } finally {
    connection.release();
  }
};

// ========== 兼容旧接口（用于平滑迁移） ==========

export const updateAlarmStatus = async (id: number, isRead: boolean): Promise<boolean> => {
  const connection = await pool.getConnection();
  try {
    console.log(`[DB] Updating alarm status: id=${id} (type: ${typeof id}), isRead=${isRead}`);
    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE `alarms` SET `is_read` = ? WHERE `id` = ?',
      [isRead ? 1 : 0, id]
    );
    console.log(`[DB] Update result: affectedRows=${result.affectedRows}`);
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`[DB] Error updating alarm status:`, error);
    throw error;
  } finally {
    connection.release();
  }
};

export const deleteAlarm = async (id: number): Promise<boolean> => {
  const connection = await pool.getConnection();
  try {
    console.log(`[DB] Deleting alarm (soft delete): id=${id} (type: ${typeof id})`);
    
    // 尝试软删除
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE `alarms` SET `is_deleted` = 1 WHERE `id` = ?',
        [id]
      );
      console.log(`[DB] Soft delete result: affectedRows=${result.affectedRows}`);
      return result.affectedRows > 0;
    } catch (error: any) {
      // 如果 is_deleted 字段不存在，回退到物理删除
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn(`[DB] is_deleted field missing, falling back to physical delete for id=${id}`);
        const [result] = await connection.execute<ResultSetHeader>(
          'DELETE FROM `alarms` WHERE `id` = ?',
          [id]
        );
        console.log(`[DB] Physical delete result: affectedRows=${result.affectedRows}`);
        return result.affectedRows > 0;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[DB] Error deleting alarm:`, error);
    throw error;
  } finally {
    connection.release();
  }
};

export const getDb = async (): Promise<Database> => {
  const [plates, blacklist, alarms] = await Promise.all([
    getPlates(),
    getBlacklist(),
    getAlarms()
  ]);

  return { plates, blacklist, alarms };
};



export const saveDb = async (db: Database): Promise<void> => {
  // 批量保存 plates
  for (const plate of db.plates) {
    await savePlate(plate);
  }
  
  // 注意：blacklist 和 alarms 应该通过专门的函数操作
  // 这里仅为了兼容性保留
};

// ========== Cameras 相关操作 ==========

export interface Camera {
  id: string;
  name: string;
  type: 'local' | 'stream' | 'file';
  url?: string;
  deviceId?: string;
  location?: string; // 地址文本
  regionCode?: string;
  latitude?: number; // 纬度
  longitude?: number; // 经度
  status: 'online' | 'offline';
  lastActive?: number;
}

export const getCamerasFromDb = async (): Promise<Camera[]> => {
  const connection = await pool.getConnection();
  try {
    // 如果 cameras 表不存在，返回空数组（兼容性处理）
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM `cameras` ORDER BY `name` ASC'
      );
      
      return rows.map((row: RowDataPacket) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        url: row.url || undefined,
        deviceId: row.device_id || undefined,
        location: row.location || undefined,
        regionCode: row.region_code || undefined,
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        status: row.status,
        lastActive: row.last_active ? parseInt(row.last_active) : undefined
      }));
    } catch (error: any) {
      // 表不存在时返回空数组
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw error;
    }
  } finally {
    connection.release();
  }
};

export const getCameraByIdFromDb = async (id: string): Promise<Camera | null> => {
  const connection = await pool.getConnection();
  try {
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM `cameras` WHERE `id` = ? LIMIT 1',
        [id]
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        url: row.url || undefined,
        deviceId: row.device_id || undefined,
        location: row.location || undefined,
        regionCode: row.region_code || undefined,
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        status: row.status,
        lastActive: row.last_active ? parseInt(row.last_active) : undefined
      };
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return null;
      }
      throw error;
    }
  } finally {
    connection.release();
  }
};

export const countCameraUrlReferences = async (url: string): Promise<number> => {
  const connection = await pool.getConnection();
  try {
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS `count` FROM `cameras` WHERE `url` = ?',
        [url]
      );
      return Number(rows[0]?.count || 0);
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return 0;
      }
      throw error;
    }
  } finally {
    connection.release();
  }
};

export const saveCameraToDb = async (camera: Camera): Promise<Camera> => {
  const connection = await pool.getConnection();
  try {
    // 确保 cameras 表存在
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`cameras\` (
        \`id\` VARCHAR(255) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`type\` ENUM('local', 'stream', 'file') NOT NULL,
        \`url\` TEXT,
        \`device_id\` VARCHAR(255),
        \`location\` VARCHAR(500),
        \`region_code\` VARCHAR(100),
        \`latitude\` DECIMAL(10, 8),
        \`longitude\` DECIMAL(11, 8),
        \`status\` ENUM('online', 'offline') DEFAULT 'offline',
        \`last_active\` BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 添加经纬度字段（如果不存在）
    try {
      await connection.execute(`ALTER TABLE \`cameras\` ADD COLUMN \`latitude\` DECIMAL(10, 8) AFTER \`location\``);
    } catch (e: any) {
      // 字段已存在，忽略错误
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    try {
      await connection.execute(`ALTER TABLE \`cameras\` ADD COLUMN \`longitude\` DECIMAL(11, 8) AFTER \`latitude\``);
    } catch (e: any) {
      // 字段已存在，忽略错误
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    try {
      await connection.execute(`ALTER TABLE \`cameras\` ADD COLUMN \`region_code\` VARCHAR(100) AFTER \`location\``);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    const query = `
      INSERT INTO \`cameras\` (
        \`id\`, \`name\`, \`type\`, \`url\`, \`device_id\`, \`location\`, \`region_code\`, \`latitude\`, \`longitude\`, \`status\`, \`last_active\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`name\` = VALUES(\`name\`),
        \`type\` = VALUES(\`type\`),
        \`url\` = VALUES(\`url\`),
        \`device_id\` = VALUES(\`device_id\`),
        \`location\` = VALUES(\`location\`),
        \`region_code\` = VALUES(\`region_code\`),
        \`latitude\` = VALUES(\`latitude\`),
        \`longitude\` = VALUES(\`longitude\`),
        \`status\` = VALUES(\`status\`),
        \`last_active\` = VALUES(\`last_active\`)
    `;

    const params = [
      camera.id,
      camera.name,
      camera.type,
      camera.url || null,
      camera.deviceId || null,
      camera.location || null,
      camera.regionCode || null,
      camera.latitude || null,
      camera.longitude || null,
      camera.status,
      camera.lastActive || null
    ];

    await connection.execute(query, params);
    return camera;
  } finally {
    connection.release();
  }
};

export const deleteCameraFromDb = async (id: string): Promise<boolean> => {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM `cameras` WHERE `id` = ?',
      [id]
    );
    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
};

// ========== Plate Records 相关操作（新结构：以车牌号为唯一标识） ==========

// 保存识别记录（每次识别都创建新记录）
export const savePlateRecord = async (record: PlateRecord): Promise<PlateRecord> => {
  const connection = await pool.getConnection();
  try {
    console.log('开始保存识别记录到数据库:', {
      plateNumber: record.plateNumber,
      timestamp: record.timestamp,
      cameraId: record.cameraId,
      cameraName: record.cameraName
    });
    
    await connection.beginTransaction();

    const query = `
      INSERT INTO \`plate_records\` (
        \`id\`, \`plate_number\`, \`plate_type\`, \`confidence\`, \`timestamp\`,
        \`camera_id\`, \`camera_name\`, \`region_code\`, \`location\`, \`image_url\`,
        \`rect_x\`, \`rect_y\`, \`rect_w\`, \`rect_h\`, \`created_at\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      record.id,
      record.plateNumber,
      record.plateType,
      record.confidence,
      record.timestamp,
      record.cameraId || null,
      record.cameraName || null,
      record.regionCode || null,
      record.location || null,
      record.imageUrl || null,
      record.rect?.x || null,
      record.rect?.y || null,
      record.rect?.w || null,
      record.rect?.h || null,
      record.createdAt || Date.now()
    ];

    console.log('执行 SQL 插入:', { query, params: params.map((p, i) => i < 5 ? p : '...') });
    const [result] = await connection.execute(query, params);
    console.log('插入结果:', result);

    // 检查黑名单并创建告警
    const [blacklistRows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `blacklist` WHERE `plate_number` = ?',
      [record.plateNumber]
    );

    if (blacklistRows.length > 0) {
      const blacklistItem = blacklistRows[0];
      console.log(`检测到黑名单车牌 ${record.plateNumber}，创建告警`);
      
      // 检查是否已存在相同的告警（避免重复创建）
      // 注意：使用 plate_number, blacklist_id 和 timestamp 来检查，因为 plate_id 可能不在 plates 表中
      const [existingAlarms] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM `alarms` WHERE `plate_number` = ? AND `blacklist_id` = ? AND `timestamp` = ?',
        [record.plateNumber, blacklistItem.id, record.timestamp]
      );
      
      if (existingAlarms.length === 0) {
        // 使用记录的时间戳，而不是当前时间，确保告警时间与识别时间一致
        const alarmTimestamp = record.timestamp || Date.now();
        
        // 尝试从摄像头表获取经纬度
        let latitude: number | null = null;
        let longitude: number | null = null;
        let regionCode: string | null = record.regionCode || null;
        
        if (record.cameraId) {
          try {
            const [cameraRows] = await connection.execute<RowDataPacket[]>(
              'SELECT `latitude`, `longitude`, `region_code` FROM `cameras` WHERE `id` = ?',
              [record.cameraId]
            );
            if (cameraRows.length > 0 && cameraRows[0].latitude && cameraRows[0].longitude) {
              latitude = parseFloat(cameraRows[0].latitude);
              longitude = parseFloat(cameraRows[0].longitude);
              console.log(`从摄像头 ${record.cameraId} 获取到坐标: (${longitude}, ${latitude})`);
            }
            if (cameraRows.length > 0 && cameraRows[0].region_code && !regionCode) {
              regionCode = String(cameraRows[0].region_code);
            }
          } catch (error) {
            console.warn(`无法从摄像头表获取坐标: ${error}`);
          }
        }
        
        // 注意：plate_id 设置为 NULL，因为记录保存在 plate_records 表中，不在 plates 表中
        // 外键约束允许 NULL 值，且告警主要关联的是 blacklist_id 和 plate_number
        // 尝试添加经纬度字段（如果表结构已更新）
        let createdAlarmId: number | null = null;
        try {
          const [insertResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO \`alarms\` (
              \`plate_id\`, \`record_id\`, \`blacklist_id\`, \`timestamp\`, \`is_read\`,
              \`plate_number\`, \`camera_id\`, \`region_code\`, \`image_path\`, \`location\`, \`latitude\`, \`longitude\`, \`reason\`, \`severity\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              null, // plate_id 设置为 NULL
              record.id, // record_id 关联到 plate_records
              blacklistItem.id,
              alarmTimestamp,
              0,
              record.plateNumber,
              record.cameraId || null,
              regionCode,
              record.imageUrl || null,
              record.location || null,
              latitude,
              longitude,
              `Blacklisted: ${blacklistItem.reason}`,
              blacklistItem.severity
            ]
          );
          createdAlarmId = insertResult.insertId;
        } catch (error: any) {
          // 如果字段不存在，使用旧格式（向后兼容）
          if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.warn('告警表未包含新字段，使用旧格式保存');
            const [insertResult] = await connection.execute<ResultSetHeader>(
              `INSERT INTO \`alarms\` (
                \`plate_id\`, \`blacklist_id\`, \`timestamp\`, \`is_read\`,
                \`plate_number\`, \`image_path\`, \`location\`, \`reason\`, \`severity\`
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                null,
                blacklistItem.id,
                alarmTimestamp,
                0,
                record.plateNumber,
                record.imageUrl || null,
                record.location || null,
                `Blacklisted: ${blacklistItem.reason}`,
                blacklistItem.severity
              ]
            );
            createdAlarmId = insertResult.insertId;
          } else {
            throw error;
          }
        }
        if (createdAlarmId && record.cameraId) {
          void enqueueAlarmClipCapture({
            alarmId: createdAlarmId,
            recordId: record.id,
            plateNumber: record.plateNumber,
            cameraId: record.cameraId
          }).catch((error) => {
            console.warn('[AlarmMedia] enqueue failed:', error);
          });
        }
        console.log(`告警创建成功: 车牌 ${record.plateNumber}, 时间 ${new Date(alarmTimestamp).toLocaleString()}`);
      } else {
        console.log(`告警已存在，跳过创建: 车牌 ${record.plateNumber}`);
      }
    } else {
      console.log(`车牌 ${record.plateNumber} 不在黑名单中，无需创建告警`);
    }

    await connection.commit();
    return record;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// 为黑名单创建告警（用于添加黑名单时检查历史记录）
export const createAlarmForBlacklist = async (record: PlateRecord, blacklistItem: BlacklistItem): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    // 检查是否已经存在相同的告警（避免重复创建）
    const [existing] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `alarms` WHERE `plate_number` = ? AND `blacklist_id` = ? AND `timestamp` = ?',
      [record.plateNumber, blacklistItem.id, record.timestamp]
    );
    
    if (existing.length > 0) {
      // 告警已存在，跳过
      return;
    }
    
    // 尝试从摄像头表获取经纬度
    let latitude: number | null = null;
    let longitude: number | null = null;
    let regionCode: string | null = record.regionCode || null;
    
    if (record.cameraId) {
      try {
        const [cameraRows] = await connection.execute<RowDataPacket[]>(
          'SELECT `latitude`, `longitude`, `region_code` FROM `cameras` WHERE `id` = ?',
          [record.cameraId]
        );
        if (cameraRows.length > 0 && cameraRows[0].latitude && cameraRows[0].longitude) {
          latitude = parseFloat(cameraRows[0].latitude);
          longitude = parseFloat(cameraRows[0].longitude);
        }
        if (cameraRows.length > 0 && cameraRows[0].region_code && !regionCode) {
          regionCode = String(cameraRows[0].region_code);
        }
      } catch (error) {
        console.warn(`无法从摄像头表获取坐标: ${error}`);
      }
    }
    
    // 注意：plate_id 设置为 NULL，因为记录保存在 plate_records 表中，不在 plates 表中
    // 外键约束允许 NULL 值，且告警主要关联的是 blacklist_id 和 plate_number
    // 尝试添加经纬度字段（如果表结构已更新）
    let createdAlarmId: number | null = null;
    try {
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`alarms\` (
          \`plate_id\`, \`record_id\`, \`blacklist_id\`, \`timestamp\`, \`is_read\`,
          \`plate_number\`, \`camera_id\`, \`region_code\`, \`image_path\`, \`location\`, \`latitude\`, \`longitude\`, \`reason\`, \`severity\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          null, // plate_id 设置为 NULL
          record.id, // record_id 关联到 plate_records
          blacklistItem.id,
          record.timestamp,
          0,
          record.plateNumber,
          record.cameraId || null,
          regionCode,
          record.imageUrl || null,
          record.location || null,
          latitude,
          longitude,
          `Blacklisted: ${blacklistItem.reason}`,
          blacklistItem.severity
        ]
      );
      createdAlarmId = insertResult.insertId;
    } catch (error: any) {
      // 如果字段不存在，使用旧格式（向后兼容）
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO \`alarms\` (
            \`plate_id\`, \`blacklist_id\`, \`timestamp\`, \`is_read\`,
            \`plate_number\`, \`image_path\`, \`location\`, \`reason\`, \`severity\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            null,
            blacklistItem.id,
            record.timestamp,
            0,
            record.plateNumber,
            record.imageUrl || null,
            record.location || null,
            `Blacklisted: ${blacklistItem.reason}`,
            blacklistItem.severity
          ]
        );
        createdAlarmId = insertResult.insertId;
      } else {
        throw error;
      }
    }
    if (createdAlarmId && record.cameraId) {
      void enqueueAlarmClipCapture({
        alarmId: createdAlarmId,
        recordId: record.id,
        plateNumber: record.plateNumber,
        cameraId: record.cameraId
      }).catch((error) => {
        console.warn('[AlarmMedia] enqueue failed:', error);
      });
    }
  } finally {
    connection.release();
  }
};

// 获取识别记录（按车牌号分组）
export const getPlateGroups = async (filters?: {
  start?: number;
  end?: number;
  type?: string;
  plateNumber?: string;
}): Promise<PlateGroup[]> => {
  const connection = await pool.getConnection();
  try {
    let query = `
      SELECT 
        \`plate_number\`,
        \`plate_type\`,
        MIN(\`timestamp\`) as \`first_seen\`,
        MAX(\`timestamp\`) as \`last_seen\`,
        COUNT(*) as \`total_count\`,
        AVG(\`confidence\`) as \`avg_confidence\`
      FROM \`plate_records\`
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.start) {
      query += ' AND `timestamp` >= ?';
      params.push(filters.start);
    }
    if (filters?.end) {
      query += ' AND `timestamp` <= ?';
      params.push(filters.end);
    }
    if (filters?.type) {
      query += ' AND `plate_type` = ?';
      params.push(filters.type);
    }
    if (filters?.plateNumber) {
      query += ' AND `plate_number` = ?';
      params.push(filters.plateNumber);
    }

    query += ' GROUP BY `plate_number`, `plate_type` ORDER BY `last_seen` DESC';

    const [rows] = await connection.execute<RowDataPacket[]>(query, params);

    // 获取每个车牌号的详细记录
    const groups: PlateGroup[] = [];
    for (const row of rows) {
      const [records] = await connection.execute<RowDataPacket[]>(
        `SELECT * FROM \`plate_records\` 
         WHERE \`plate_number\` = ? 
         ORDER BY \`timestamp\` DESC`,
        [row.plate_number]
      );

      const recordList: PlateRecord[] = records.map((r: RowDataPacket) => ({
        id: r.id,
        plateNumber: r.plate_number,
        plateType: r.plate_type,
        confidence: parseFloat(r.confidence),
        timestamp: parseInt(r.timestamp),
        cameraId: r.camera_id || undefined,
        cameraName: r.camera_name || undefined,
        regionCode: r.region_code || undefined,
        location: r.location || undefined,
        imageUrl: r.image_url || undefined,
        rect: r.rect_x !== null ? {
          x: r.rect_x,
          y: r.rect_y,
          w: r.rect_w,
          h: r.rect_h
        } : undefined,
        createdAt: parseInt(r.created_at)
      }));

      // 提取唯一的位置和摄像头列表
      const locations = [...new Set(recordList.map(r => r.location).filter(Boolean))] as string[];
      const cameras = [...new Set(recordList.map(r => r.cameraName).filter(Boolean))] as string[];

      groups.push({
        plateNumber: row.plate_number,
        plateType: row.plate_type,
        firstSeen: parseInt(row.first_seen),
        lastSeen: parseInt(row.last_seen),
        totalCount: parseInt(row.total_count),
        records: recordList,
        averageConfidence: parseFloat(row.avg_confidence),
        locations,
        cameras
      });
    }

    return groups;
  } finally {
    connection.release();
  }
};

// 获取所有识别记录（用于导出，不分组）
export const getAllPlateRecords = async (filters?: {
  start?: number;
  end?: number;
  type?: string;
  plateNumber?: string;
}): Promise<PlateRecord[]> => {
  const connection = await pool.getConnection();
  try {
    let query = `
      SELECT * FROM \`plate_records\`
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.start) {
      query += ' AND `timestamp` >= ?';
      params.push(filters.start);
    }
    if (filters?.end) {
      query += ' AND `timestamp` <= ?';
      params.push(filters.end);
    }
    if (filters?.type) {
      query += ' AND `plate_type` = ?';
      params.push(filters.type);
    }
    if (filters?.plateNumber) {
      query += ' AND `plate_number` = ?';
      params.push(filters.plateNumber);
    }

    query += ' ORDER BY `timestamp` DESC';

    const [rows] = await connection.execute<RowDataPacket[]>(query, params);

    return rows.map((r: RowDataPacket) => ({
      id: r.id,
      plateNumber: r.plate_number,
      plateType: r.plate_type,
      confidence: parseFloat(r.confidence),
      timestamp: parseInt(r.timestamp),
      cameraId: r.camera_id || undefined,
      cameraName: r.camera_name || undefined,
      regionCode: r.region_code || undefined,
      location: r.location || undefined,
      imageUrl: r.image_url || undefined,
      rect: r.rect_x !== null ? {
        x: r.rect_x,
        y: r.rect_y,
        w: r.rect_w,
        h: r.rect_h
      } : undefined,
      createdAt: parseInt(r.created_at)
    }));
  } finally {
    connection.release();
  }
};

export const getPlateRecordImageUrlById = async (recordId: string): Promise<string | null> => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT `image_url` FROM `plate_records` WHERE `id` = ? LIMIT 1',
      [recordId]
    );
    if (rows.length === 0) return null;
    return (rows[0].image_url as string | null) || null;
  } finally {
    connection.release();
  }
};

export const getPlateRecordImageUrlsByNumber = async (plateNumber: string): Promise<string[]> => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT `image_url` FROM `plate_records` WHERE `plate_number` = ? AND `image_url` IS NOT NULL AND `image_url` <> \'\'',
      [plateNumber]
    );
    return rows
      .map((row: RowDataPacket) => String(row.image_url || '').trim())
      .filter(Boolean);
  } finally {
    connection.release();
  }
};

export const countMediaPathReferences = async (mediaPath: string): Promise<number> => {
  const connection = await pool.getConnection();
  try {
    const [plateRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS `count` FROM `plate_records` WHERE `image_url` = ?',
      [mediaPath]
    );
    const plateCount = Number(plateRows[0]?.count || 0);

    let alarmCount = 0;
    try {
      const [alarmRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS `count` FROM `alarms` WHERE `image_path` = ? AND `is_deleted` = 0',
        [mediaPath]
      );
      alarmCount = Number(alarmRows[0]?.count || 0);
    } catch (error: any) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const [alarmRows] = await connection.execute<RowDataPacket[]>(
          'SELECT COUNT(*) AS `count` FROM `alarms` WHERE `image_path` = ?',
          [mediaPath]
        );
        alarmCount = Number(alarmRows[0]?.count || 0);
      } else {
        throw error;
      }
    }
    return plateCount + alarmCount;
  } finally {
    connection.release();
  }
};

// 删除单条识别记录
export const deletePlateRecord = async (recordId: string): Promise<boolean> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM `plate_records` WHERE `id` = ?',
      [recordId]
    );

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// 删除指定车牌号的所有记录
export const deletePlateRecordsByNumber = async (plateNumber: string): Promise<number> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM `plate_records` WHERE `plate_number` = ?',
      [plateNumber]
    );

    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
