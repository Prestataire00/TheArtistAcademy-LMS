import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError } from './errors';

/**
 * Middleware : verifie qu'un formateur est bien responsable de la formation
 * contenant l'UA ciblee (req.params.id ou req.params.uaId).
 * Les admins passent sans verification.
 */
export function verifyTrainerOwnership() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return next(new ForbiddenError());

      // Admin/superadmin : pas de restriction
      if (user.roles.some((r) => r === 'admin' || r === 'superadmin')) {
        return next();
      }

      // Trainer : verifier ownership via trainerId
      const uaId = req.params.id || req.params.uaId;
      if (!uaId) return next(new ForbiddenError('UA non specifiee'));

      const ua = await prisma.uA.findUnique({
        where: { id: uaId },
        include: { module: { include: { formation: { select: { trainerId: true } } } } },
      });

      if (!ua) return next(new NotFoundError('UA'));

      if (ua.module.formation.trainerId !== user.userId) {
        return next(new ForbiddenError('Vous ne gerez pas cette formation'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
