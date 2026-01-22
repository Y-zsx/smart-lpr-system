import { pool } from '../config/database';
import { LicensePlate, BlacklistItem, Alarm, Rect } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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
  const connection = await pool.getConnection();
  try {
    let query = 'SELECT * FROM `plates` WHERE 1=1';
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
      query += ' AND `type` = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY `timestamp` DESC';

    const [rows] = await connection.execute<RowDataPacket[]>(query, params);
    
    return rows.map((row: RowDataPacket) => ({
      id: row.id,
      number: row.number,
      type: row.type,
      confidence: parseFloat(row.confidence),
      timestamp: parseInt(row.timestamp),
      imageUrl: row.image_url || undefined,
      location: row.location || undefined,
      rect: row.rect_x !== null ? {
        x: row.rect_x,
        y: row.rect_y,
        w: row.rect_w,
        h: row.rect_h
      } : undefined,
      saved: row.saved === 1
    }));
  } finally {
    connection.release();
  }
};

export const savePlate = async (plate: LicensePlate): Promise<LicensePlate> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const query = `
      INSERT INTO \`plates\` (
        \`id\`, \`number\`, \`type\`, \`confidence\`, \`timestamp\`,
        \`image_url\`, \`location\`, \`rect_x\`, \`rect_y\`, \`rect_w\`, \`rect_h\`, \`saved\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`number\` = VALUES(\`number\`),
        \`type\` = VALUES(\`type\`),
        \`confidence\` = VALUES(\`confidence\`),
        \`timestamp\` = VALUES(\`timestamp\`),
        \`image_url\` = VALUES(\`image_url\`),
        \`location\` = VALUES(\`location\`),
        \`rect_x\` = VALUES(\`rect_x\`),
        \`rect_y\` = VALUES(\`rect_y\`),
        \`rect_w\` = VALUES(\`rect_w\`),
        \`rect_h\` = VALUES(\`rect_h\`),
        \`saved\` = VALUES(\`saved\`)
    `;

    const params = [
      plate.id,
      plate.number,
      plate.type,
      plate.confidence,
      plate.timestamp,
      plate.imageUrl || null,
      plate.location || null,
      plate.rect?.x || null,
      plate.rect?.y || null,
      plate.rect?.w || null,
      plate.rect?.h || null,
      plate.saved ? 1 : 0
    ];

    await connection.execute(query, params);

    // 检查黑名单并创建告警
    const [blacklistRows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `blacklist` WHERE `plate_number` = ?',
      [plate.number]
    );

    if (blacklistRows.length > 0) {
      const blacklistItem = blacklistRows[0];
      await connection.execute(
        `INSERT INTO \`alarms\` (
          \`plate_id\`, \`blacklist_id\`, \`timestamp\`, \`is_read\`,
          \`plate_number\`, \`image_path\`, \`location\`, \`reason\`, \`severity\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plate.id,
          blacklistItem.id,
          Date.now(),
          0,
          plate.number,
          plate.imageUrl || null,
          plate.location || null,
          `Blacklisted: ${blacklistItem.reason}`,
          blacklistItem.severity
        ]
      );
    }

    await connection.commit();
    return plate;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM `alarms` ORDER BY `timestamp` DESC'
    );
    
    return rows.map((row: RowDataPacket) => ({
      id: row.id,
      plate_id: row.plate_id || undefined,
      blacklist_id: row.blacklist_id || undefined,
      timestamp: parseInt(row.timestamp),
      is_read: row.is_read,
      plate_number: row.plate_number,
      image_path: row.image_path || undefined,
      location: row.location || undefined,
      reason: row.reason,
      severity: row.severity
    }));
  } finally {
    connection.release();
  }
};

// ========== 兼容旧接口（用于平滑迁移） ==========

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
