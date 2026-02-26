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

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Refuse to start with default/empty secret.');
}

function getJwtSecret(): string {
  return JWT_SECRET as string;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function parseQueryToken(req: Request): string | null {
  const token = req.query.token;
  if (typeof token === 'string' && token.trim()) {
    return token.trim();
  }
  return null;
}

function resolveToken(req: Request): string | null {
  const bearer = parseBearerToken(req.headers.authorization);
  if (bearer) return bearer;
  // 兼容 <img>/<video> 无法携带 Authorization 头的场景
  return parseQueryToken(req);
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = resolveToken(req);
  if (!token) {
    next(new AppError('Unauthorized: missing token', 401, 'UNAUTHORIZED'));
    return;
  }

  let payload: JwtPayload & AuthUser;
  try {
    payload = jwt.verify(token, getJwtSecret()) as unknown as JwtPayload & AuthUser;
  } catch (_error) {
    next(new AppError('Unauthorized: invalid or expired token', 401, 'INVALID_TOKEN'));
    return;
  }
  try {
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role
    };
    const accessContext = await getUserAccessContext(payload.id);
    req.accessContext = accessContext;
    req.dataScope = accessContext.dataScope;
    next();
  } catch (error) {
    console.error('[Auth] load access context failed:', error);
    next(new AppError('Failed to load access context', 500, 'AUTH_CONTEXT_ERROR'));
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
