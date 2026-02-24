import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { AppError } from '../../utils/AppError';
import { AccessContext, getUserAccessContext } from '../iam/rbacService';

type Role = 'admin' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  role: Role | 'operator';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  accessContext?: AccessContext;
  dataScope?: AccessContext['dataScope'];
}

const JWT_SECRET = process.env.JWT_SECRET || 'smart-lpr-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next(new AppError('Unauthorized: missing token', 401, 'UNAUTHORIZED'));
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & AuthUser;
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role
    };
    getUserAccessContext(payload.id)
      .then((accessContext) => {
        req.accessContext = accessContext;
        req.dataScope = accessContext.dataScope;
        next();
      })
      .catch((error) => {
        console.error('[Auth] load access context failed:', error);
        next(new AppError('Failed to load access context', 500, 'AUTH_CONTEXT_ERROR'));
      });
  } catch (_error) {
    next(new AppError('Unauthorized: invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.accessContext) {
      next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      return;
    }
    if (!roles.some(role => req.accessContext!.roles.includes(role))) {
      next(new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.accessContext) {
      next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      return;
    }
    if (!req.accessContext.permissions.includes(permission)) {
      next(new AppError(`Forbidden: missing permission ${permission}`, 403, 'FORBIDDEN_PERMISSION'));
      return;
    }
    next();
  };
}

export function applyDataScope() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.accessContext) {
      next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      return;
    }
    req.dataScope = req.accessContext.dataScope;
    next();
  };
}
