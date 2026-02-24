import { RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { pool } from '../../config/database';

export interface DataScope {
  all: boolean;
  cameraIds: string[];
  regionCodes: string[];
}

export interface AccessContext {
  roles: string[];
  permissions: string[];
  dataScope: DataScope;
}

export interface IamUser {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled';
  roles: string[];
}

export interface IamRole {
  id: string;
  roleKey: string;
  roleName: string;
  description?: string;
  permissions: string[];
  dataScope: DataScope;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export async function findUserByCredentials(username: string, password: string): Promise<IamUser | null> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, username, display_name, status
       FROM iam_users
       WHERE username = ? AND password = ? AND status = 'active'
       LIMIT 1`,
      [username, password]
    );
    if (!rows.length) return null;
    const user = rows[0];
    const roles = await getUserRoles(connection, user.id);
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      status: user.status,
      roles
    };
  } finally {
    connection.release();
  }
}

async function getUserRoles(connection: PoolConnection, userId: string): Promise<string[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT r.role_key
     FROM iam_user_roles ur
     JOIN iam_roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map(r => r.role_key);
}

export async function getUserAccessContext(userId: string): Promise<AccessContext> {
  const connection = await pool.getConnection();
  try {
    const roles = await getUserRoles(connection, userId);
    if (!roles.length) {
      return {
        roles: [],
        permissions: [],
        dataScope: { all: false, cameraIds: [], regionCodes: [] }
      };
    }

    const [permissionRows] = await connection.execute<RowDataPacket[]>(
      `SELECT DISTINCT p.permission_key
       FROM iam_user_roles ur
       JOIN iam_role_permissions rp ON rp.role_id = ur.role_id
       JOIN iam_permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    const [scopeRows] = await connection.execute<RowDataPacket[]>(
      `SELECT DISTINCT rds.scope_type, rds.scope_value
       FROM iam_user_roles ur
       JOIN iam_role_data_scopes rds ON rds.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );

    const dataScope: DataScope = {
      all: scopeRows.some(row => row.scope_type === 'all'),
      cameraIds: uniq(scopeRows.filter((r: RowDataPacket) => r.scope_type === 'camera').map((r: RowDataPacket) => String(r.scope_value))),
      regionCodes: uniq(scopeRows.filter((r: RowDataPacket) => r.scope_type === 'region').map((r: RowDataPacket) => String(r.scope_value)))
    };

    return {
      roles,
      permissions: uniq(permissionRows.map(row => String(row.permission_key))),
      dataScope
    };
  } finally {
    connection.release();
  }
}

export async function listUsers(): Promise<IamUser[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, username, display_name, status
       FROM iam_users
       ORDER BY username ASC`
    );

    const users: IamUser[] = [];
    for (const row of rows) {
      const roles = await getUserRoles(connection, row.id);
      users.push({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        status: row.status,
        roles
      });
    }
    return users;
  } finally {
    connection.release();
  }
}

export async function listPermissions(): Promise<Array<{ id: string; key: string; name: string; group: string }>> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, permission_key, permission_name, group_key
     FROM iam_permissions
     ORDER BY group_key, permission_key`
  );
  return rows.map(row => ({
    id: row.id,
    key: row.permission_key,
    name: row.permission_name,
    group: row.group_key
  }));
}

export async function listRoles(): Promise<IamRole[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, role_key, role_name, description
       FROM iam_roles
       ORDER BY role_key`
    );

    const roles: IamRole[] = [];
    for (const row of rows) {
      const [permRows] = await connection.execute<RowDataPacket[]>(
        `SELECT p.permission_key
         FROM iam_role_permissions rp
         JOIN iam_permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [row.id]
      );
      const [scopeRows] = await connection.execute<RowDataPacket[]>(
        `SELECT scope_type, scope_value
         FROM iam_role_data_scopes
         WHERE role_id = ?`,
        [row.id]
      );
      roles.push({
        id: row.id,
        roleKey: row.role_key,
        roleName: row.role_name,
        description: row.description || undefined,
        permissions: uniq(permRows.map(p => p.permission_key)),
        dataScope: {
          all: scopeRows.some(s => s.scope_type === 'all'),
          cameraIds: uniq(scopeRows.filter(s => s.scope_type === 'camera').map(s => String(s.scope_value))),
          regionCodes: uniq(scopeRows.filter(s => s.scope_type === 'region').map(s => String(s.scope_value)))
        }
      });
    }

    return roles;
  } finally {
    connection.release();
  }
}

export async function updateUserRoles(userId: string, roleKeys: string[]): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM iam_user_roles WHERE user_id = ?', [userId]);

    if (roleKeys.length) {
      const [roleRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, role_key FROM iam_roles WHERE role_key IN (${roleKeys.map(() => '?').join(',')})`,
        roleKeys
      );
      for (const role of roleRows) {
        await connection.execute(
          'INSERT INTO iam_user_roles (user_id, role_id) VALUES (?, ?)',
          [userId, role.id]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRolePermissions(roleKey: string, permissionKeys: string[]): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[role]] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM iam_roles WHERE role_key = ? LIMIT 1',
      [roleKey]
    );
    if (!role?.id) {
      throw new Error('Role not found');
    }

    await connection.execute('DELETE FROM iam_role_permissions WHERE role_id = ?', [role.id]);

    if (permissionKeys.length) {
      const [permRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM iam_permissions WHERE permission_key IN (${permissionKeys.map(() => '?').join(',')})`,
        permissionKeys
      );
      for (const perm of permRows) {
        await connection.execute(
          'INSERT INTO iam_role_permissions (role_id, permission_id) VALUES (?, ?)',
          [role.id, perm.id]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRoleDataScope(
  roleKey: string,
  dataScope: { all?: boolean; cameraIds?: string[]; regionCodes?: string[] }
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[role]] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM iam_roles WHERE role_key = ? LIMIT 1',
      [roleKey]
    );
    if (!role?.id) {
      throw new Error('Role not found');
    }

    await connection.execute('DELETE FROM iam_role_data_scopes WHERE role_id = ?', [role.id]);
    if (dataScope.all) {
      await connection.execute(
        'INSERT INTO iam_role_data_scopes (role_id, scope_type, scope_value) VALUES (?, ?, ?)',
        [role.id, 'all', '*']
      );
    } else {
      for (const cameraId of uniq(dataScope.cameraIds || [])) {
        await connection.execute(
          'INSERT INTO iam_role_data_scopes (role_id, scope_type, scope_value) VALUES (?, ?, ?)',
          [role.id, 'camera', cameraId]
        );
      }
      for (const regionCode of uniq(dataScope.regionCodes || [])) {
        await connection.execute(
          'INSERT INTO iam_role_data_scopes (role_id, scope_type, scope_value) VALUES (?, ?, ?)',
          [role.id, 'region', regionCode]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
