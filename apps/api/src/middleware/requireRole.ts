import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../shared/errors';

/**
 * Autorise si l'utilisateur a au moins UN des rôles requis.
 * Plus de hiérarchie linéaire : un superadmin n'hérite plus automatiquement
 * des permissions admin/trainer/learner — il doit les avoir listées
 * explicitement dans `roles`.
 */
export function requireRole(...required: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw new ForbiddenError();

    const hasRole = user.roles.some((r) => required.includes(r));
    if (!hasRole) throw new ForbiddenError('Permissions insuffisantes');
    next();
  };
}
