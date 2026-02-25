import { NextFunction, Request, Response } from 'express';
import {
  listPermissions,
  listRoles,
  listUsers,
  updateRoleDataScope,
  updateRolePermissions,
  updateUserRoles
} from './rbacService';
import { AppError } from '../../utils/AppError';

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    console.error('[IAM] getUsers failed:', error);
    next(new AppError('Failed to fetch users', 500, 'IAM_USERS_FETCH_FAILED'));
  }
}

export async function getRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await listRoles();
    res.json(roles);
  } catch (error) {
    console.error('[IAM] getRoles failed:', error);
    next(new AppError('Failed to fetch roles', 500, 'IAM_ROLES_FETCH_FAILED'));
  }
}

export async function getPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await listPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('[IAM] getPermissions failed:', error);
    next(new AppError('Failed to fetch permissions', 500, 'IAM_PERMS_FETCH_FAILED'));
  }
}

export async function setUserRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.params.userId || '');
    const roleKeys = Array.isArray(req.body?.roleKeys) ? req.body.roleKeys : [];
    await updateUserRoles(userId, roleKeys);
    res.json({ success: true });
  } catch (error) {
    console.error('[IAM] setUserRoles failed:', error);
    next(new AppError('Failed to update user roles', 500, 'IAM_USER_ROLES_UPDATE_FAILED'));
  }
}

export async function setRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const roleKey = String(req.params.roleKey || '');
    const permissionKeys = Array.isArray(req.body?.permissionKeys) ? req.body.permissionKeys : [];
    await updateRolePermissions(roleKey, permissionKeys);
    res.json({ success: true });
  } catch (error) {
    console.error('[IAM] setRolePermissions failed:', error);
    next(new AppError('Failed to update role permissions', 500, 'IAM_ROLE_PERMS_UPDATE_FAILED'));
  }
}

export async function setRoleDataScope(req: Request, res: Response, next: NextFunction) {
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
    next(new AppError('Failed to update role data scope', 500, 'IAM_ROLE_SCOPE_UPDATE_FAILED'));
  }
}
