import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { AuthenticatedRequest, AuthUser, signToken } from './auth';
import { findUserByCredentials, getUserAccessContext } from '../iam/rbacService';

export async function login(req: Request, res: Response, next: NextFunction) {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    next(new AppError('username and password are required', 400, 'VALIDATION_ERROR'));
    return;
  }

  try {
    const userRecord = await findUserByCredentials(username, password);
    if (!userRecord) {
      next(new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS'));
      return;
    }
    const access = await getUserAccessContext(userRecord.id);
    const user: AuthUser = {
      id: userRecord.id,
      username: userRecord.username,
      role: access.roles.includes('admin') ? 'admin' : access.roles.includes('viewer') ? 'viewer' : 'operator'
    };
    const token = signToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: {
          ...user,
          displayName: userRecord.displayName
        },
        roles: access.roles,
        permissions: access.permissions,
        dataScope: access.dataScope
      }
    });
  } catch (error) {
    console.error('[AuthController] login failed', error);
    next(new AppError('Login failed', 500, 'LOGIN_FAILED'));
  }
}

export function me(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized'
    });
    return;
  }
  res.json({
    success: true,
    data: {
      user: req.user,
      roles: req.accessContext?.roles || [],
      permissions: req.accessContext?.permissions || [],
      dataScope: req.accessContext?.dataScope || { all: false, cameraIds: [], regionCodes: [] }
    }
  });
}
