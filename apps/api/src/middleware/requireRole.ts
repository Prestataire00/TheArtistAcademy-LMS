import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../shared/errors';

const roleHierarchy: Record<UserRole, number> = {
  learner: 0,
  trainer: 1,
  admin: 2,
  superadmin: 3,
};

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw new ForbiddenError();

    const hasRole = roles.some(
      (role) => roleHierarchy[user.role] >= roleHierarchy[role],
    );

    if (!hasRole) throw new ForbiddenError('Permissions insuffisantes');
    next();
  };
}
