import { Request, Response } from 'express';
import {
  listPermissions,
  listRoles,
  listUsers,
  updateRoleDataScope,
  updateRolePermissions,
  updateUserRoles
} from './rbacService';

export async function getUsers(_req: Request, res: Response) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    console.error('[IAM] getUsers failed:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
}

export async function getRoles(_req: Request, res: Response) {
  try {
    const roles = await listRoles();
    res.json(roles);
  } catch (error) {
    console.error('[IAM] getRoles failed:', error);
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
}

export async function getPermissions(_req: Request, res: Response) {
  try {
    const permissions = await listPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('[IAM] getPermissions failed:', error);
    res.status(500).json({ message: 'Failed to fetch permissions' });
  }
}

export async function setUserRoles(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId || '');
    const roleKeys = Array.isArray(req.body?.roleKeys) ? req.body.roleKeys : [];
    await updateUserRoles(userId, roleKeys);
    res.json({ success: true });
  } catch (error) {
    console.error('[IAM] setUserRoles failed:', error);
    res.status(500).json({ message: 'Failed to update user roles' });
  }
}

export async function setRolePermissions(req: Request, res: Response) {
  try {
    const roleKey = String(req.params.roleKey || '');
    const permissionKeys = Array.isArray(req.body?.permissionKeys) ? req.body.permissionKeys : [];
    await updateRolePermissions(roleKey, permissionKeys);
    res.json({ success: true });
  } catch (error) {
    console.error('[IAM] setRolePermissions failed:', error);
    res.status(500).json({ message: 'Failed to update role permissions' });
  }
}

export async function setRoleDataScope(req: Request, res: Response) {
  try {
    const roleKey = String(req.params.roleKey || '');
    await updateRoleDataScope(roleKey, {
      all: Boolean(req.body?.all),
      cameraIds: Array.isArray(req.body?.cameraIds) ? req.body.cameraIds : [],
      regionCodes: Array.isArray(req.body?.regionCodes) ? req.body.regionCodes : []
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[IAM] setRoleDataScope failed:', error);
    res.status(500).json({ message: 'Failed to update role data scope' });
  }
}
