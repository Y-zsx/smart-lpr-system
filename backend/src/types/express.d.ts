import type { AuthUser } from '../modules/auth/auth';
import type { AccessContext } from '../modules/iam/rbacService';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessContext?: AccessContext;
      dataScope?: AccessContext['dataScope'];
    }
  }
}

export {};

