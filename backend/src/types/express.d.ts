import type { AuthUser } from '../middlewares/auth';
import type { AccessContext } from '../services/rbacService';

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

