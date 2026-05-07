import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../shared/errors';

/**
 * Autorise si le rôle de l'utilisateur figure dans la liste des rôles requis.
 * Pas de hiérarchie linéaire : chaque route liste explicitement les rôles
 * autorisés (ex : `requireRole('admin', 'superadmin')`).
 */
export function requireRole(...required: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw new ForbiddenError();

    if (!required.includes(user.role)) {
      throw new ForbiddenError('Permissions insuffisantes');
    }
    next();
  };
}
